'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { isSuperadminLoggedIn } from '../../../lib/superadminAuth';
import {
  createClient,
  createClientRole,
  listAllPermissions,
  getClientRolePermissions,
  addClientRolePermission,
  removeClientRolePermission,
  createClientUser,
} from '../../../lib/SuperadminService';

const STEPS = ['Client', 'Roles', 'Permissions', 'First User', 'Done'];

export default function OnboardingPage() {
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);
  const [step, setStep] = useState(0);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  // Step 0: client
  const [clientForm, setClientForm] = useState({ name: '', domain: '', description: '' });
  const [clientId, setClientId] = useState(null);
  const [clientName, setClientName] = useState('');

  // Step 1: roles
  const [roleInputs, setRoleInputs] = useState([{ name: '', is_default: false }]);
  const [createdRoles, setCreatedRoles] = useState([]);

  // Step 2: permissions
  const [allPermissions, setAllPermissions] = useState([]);
  const [selectedRoleId, setSelectedRoleId] = useState(null);
  const [rolePerms, setRolePerms] = useState({});  // { roleId: Set<permId> }
  const [permFilter, setPermFilter] = useState('');
  const [permsSaving, setPermsSaving] = useState(false);

  // Step 3: user
  const [userForm, setUserForm] = useState({ name: '', email: '', password: '', role_id: '' });
  const [createdUser, setCreatedUser] = useState(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!isSuperadminLoggedIn()) {
      window.location.replace('/superadmin/login');
      return;
    }
    setAuthChecked(true);
  }, []);

  if (!authChecked) return null;

  // ── Step 0: create client ─────────────────────────────────────────────────
  const handleCreateClient = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const data = await createClient(clientForm);
      setClientId(data.client.id);
      setClientName(data.client.name);
      setStep(1);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  // ── Step 1: create roles ──────────────────────────────────────────────────
  const addRoleInput = () => setRoleInputs((r) => [...r, { name: '', is_default: false }]);
  const updateRoleInput = (i, field, value) =>
    setRoleInputs((r) => r.map((row, idx) => idx === i ? { ...row, [field]: value } : row));
  const removeRoleInput = (i) => setRoleInputs((r) => r.filter((_, idx) => idx !== i));

  const handleCreateRoles = async (e) => {
    e.preventDefault();
    const valid = roleInputs.filter((r) => r.name.trim());
    if (valid.length === 0) { setStep(2); return; }
    setSaving(true);
    setError('');
    try {
      const results = await Promise.all(
        valid.map((r) => createClientRole(clientId, { name: r.name.trim(), is_default: r.is_default }))
      );
      const roles = results.map((r) => r.role);
      setCreatedRoles(roles);
      setSelectedRoleId(roles[0]?.id || null);
      const initPerms = {};
      roles.forEach((r) => { initPerms[r.id] = new Set(); });
      setRolePerms(initPerms);
      const permsData = await listAllPermissions();
      setAllPermissions(permsData.permissions || []);
      setStep(2);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const skipRoles = () => { setCreatedRoles([]); setStep(2); };

  // ── Step 2: assign permissions ────────────────────────────────────────────
  const togglePerm = async (permId) => {
    if (!selectedRoleId || permsSaving) return;
    setPermsSaving(true);
    setError('');
    try {
      const current = rolePerms[selectedRoleId] || new Set();
      if (current.has(permId)) {
        await removeClientRolePermission(clientId, selectedRoleId, permId);
        setRolePerms((p) => {
          const next = new Set(p[selectedRoleId]);
          next.delete(permId);
          return { ...p, [selectedRoleId]: next };
        });
      } else {
        await addClientRolePermission(clientId, selectedRoleId, permId);
        setRolePerms((p) => {
          const next = new Set(p[selectedRoleId]);
          next.add(permId);
          return { ...p, [selectedRoleId]: next };
        });
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setPermsSaving(false);
    }
  };

  const filteredPerms = allPermissions.filter((p) => {
    if (!permFilter) return true;
    const q = permFilter.toLowerCase();
    return p.service?.toLowerCase().includes(q) || p.resource?.toLowerCase().includes(q) || p.action?.toLowerCase().includes(q);
  });

  // True when every currently-visible permission is already assigned to the selected role.
  const allFilteredSelected =
    !!selectedRoleId &&
    filteredPerms.length > 0 &&
    filteredPerms.every((p) => (rolePerms[selectedRoleId] || new Set()).has(p.id));

  // Bulk add/remove every visible (filtered) permission for the selected role.
  const toggleAllPerms = async () => {
    if (!selectedRoleId || permsSaving || filteredPerms.length === 0) return;
    setPermsSaving(true);
    setError('');
    try {
      const current = new Set(rolePerms[selectedRoleId] || new Set());
      if (allFilteredSelected) {
        for (const p of filteredPerms) {
          if (current.has(p.id)) {
            await removeClientRolePermission(clientId, selectedRoleId, p.id);
            current.delete(p.id);
          }
        }
      } else {
        for (const p of filteredPerms) {
          if (!current.has(p.id)) {
            await addClientRolePermission(clientId, selectedRoleId, p.id);
            current.add(p.id);
          }
        }
      }
      setRolePerms((prev) => ({ ...prev, [selectedRoleId]: current }));
    } catch (err) {
      setError(err.message);
    } finally {
      setPermsSaving(false);
    }
  };

  // ── Step 3: create user ───────────────────────────────────────────────────
  const handleCreateUser = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const data = await createClientUser(clientId, userForm);
      setCreatedUser(data.user);
      setStep(4);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const skipUser = () => setStep(4);

  const inp = { padding: '9px 11px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '14px', boxSizing: 'border-box', width: '100%' };
  const btn = (bg = '#007bff') => ({ padding: '10px 22px', background: bg, color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: '600', fontSize: '14px' });

  return (
    <div style={{ fontFamily: 'system-ui, -apple-system, sans-serif', minHeight: '100vh', background: '#f5f5f5' }}>
      {/* Navbar */}
      <nav style={{ background: '#1a1a2e', color: 'white', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '56px' }}>
        <span style={{ fontWeight: '700', fontSize: '15px' }}>⚡ Platform Admin</span>
        <button onClick={() => router.push('/superadmin')} style={{ background: 'none', border: '1px solid #555', color: '#ccc', padding: '6px 14px', borderRadius: '4px', cursor: 'pointer', fontSize: '13px' }}>
          ← Dashboard
        </button>
      </nav>

      <div style={{ maxWidth: '780px', margin: '40px auto', padding: '0 20px' }}>
        <h1 style={{ margin: '0 0 6px', fontSize: '24px' }}>Onboard New Client</h1>
        <p style={{ margin: '0 0 32px', color: '#666', fontSize: '14px' }}>Set up a client workspace in four steps.</p>

        {/* Step indicator */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '36px' }}>
          {STEPS.map((label, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{
                  width: 32, height: 32, borderRadius: '50%',
                  background: i < step ? '#28a745' : i === step ? '#007bff' : '#ddd',
                  color: i <= step ? 'white' : '#999',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: '700', fontSize: '13px',
                }}>
                  {i < step ? '✓' : i + 1}
                </div>
                <span style={{ fontSize: '11px', marginTop: '4px', color: i === step ? '#007bff' : i < step ? '#28a745' : '#999', whiteSpace: 'nowrap', fontWeight: i === step ? '600' : '400' }}>
                  {label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div style={{ width: '60px', height: '2px', background: i < step ? '#28a745' : '#ddd', margin: '0 4px', marginBottom: '18px' }} />
              )}
            </div>
          ))}
        </div>

        {error && (
          <div style={{ padding: '10px 14px', background: '#ffebee', color: '#c62828', borderRadius: '4px', marginBottom: '20px', fontSize: '14px' }}>{error}</div>
        )}

        {/* ── Step 0: Client Info ──────────────────────────────────── */}
        {step === 0 && (
          <div style={{ background: 'white', padding: '28px', borderRadius: '8px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
            <h2 style={{ margin: '0 0 24px', fontSize: '18px' }}>Client Details</h2>
            <form onSubmit={handleCreateClient}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600', fontSize: '13px' }}>Client Name *</label>
                <input value={clientForm.name} onChange={(e) => setClientForm((f) => ({ ...f, name: e.target.value }))} required placeholder="Acme Corp" style={inp} />
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600', fontSize: '13px' }}>Domain</label>
                <input value={clientForm.domain} onChange={(e) => setClientForm((f) => ({ ...f, domain: e.target.value }))} placeholder="acme.example.com" style={inp} />
                <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#888' }}>Users visiting this domain will be auto-associated with this client.</p>
              </div>
              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600', fontSize: '13px' }}>Description</label>
                <input value={clientForm.description} onChange={(e) => setClientForm((f) => ({ ...f, description: e.target.value }))} placeholder="Optional" style={inp} />
              </div>
              <button type="submit" disabled={saving} style={btn(saving ? '#aaa' : '#007bff')}>
                {saving ? 'Creating...' : 'Create Client & Continue →'}
              </button>
            </form>
          </div>
        )}

        {/* ── Step 1: Roles ──────────────────────────────────────────── */}
        {step === 1 && (
          <div style={{ background: 'white', padding: '28px', borderRadius: '8px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
            <h2 style={{ margin: '0 0 6px', fontSize: '18px' }}>Set Up Roles</h2>
            <p style={{ margin: '0 0 24px', color: '#666', fontSize: '14px' }}>Define the roles for <strong>{clientName}</strong>. You can add more later.</p>
            <form onSubmit={handleCreateRoles}>
              <div style={{ display: 'flex', gap: '10px', marginBottom: '6px', paddingBottom: '6px', borderBottom: '1px solid #f0f0f0' }}>
                <span style={{ flex: 1, fontSize: '12px', fontWeight: '600', color: '#888' }}>ROLE NAME</span>
                <span style={{ width: '120px', fontSize: '12px', fontWeight: '600', color: '#888' }}>DEFAULT ROLE</span>
                <span style={{ width: '32px' }}></span>
              </div>
              {roleInputs.map((row, i) => (
                <div key={i} style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '10px' }}>
                  <input
                    value={row.name}
                    onChange={(e) => updateRoleInput(i, 'name', e.target.value)}
                    placeholder={`e.g. ${i === 0 ? 'Admin' : i === 1 ? 'Viewer' : 'Member'}`}
                    style={{ ...inp, flex: 1 }}
                  />
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', width: '120px', fontSize: '13px', cursor: 'pointer' }}>
                    <input type="checkbox" checked={row.is_default} onChange={(e) => updateRoleInput(i, 'is_default', e.target.checked)} />
                    Set as default
                  </label>
                  <button type="button" onClick={() => removeRoleInput(i)} disabled={roleInputs.length === 1}
                    style={{ width: '32px', height: '32px', background: 'none', border: '1px solid #ddd', borderRadius: '4px', cursor: roleInputs.length === 1 ? 'not-allowed' : 'pointer', color: '#d32f2f', fontSize: '16px' }}>
                    ×
                  </button>
                </div>
              ))}
              <button type="button" onClick={addRoleInput} style={{ padding: '7px 14px', background: 'none', border: '1px dashed #007bff', color: '#007bff', borderRadius: '4px', cursor: 'pointer', fontSize: '13px', marginBottom: '24px' }}>
                + Add another role
              </button>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button type="submit" disabled={saving} style={btn(saving ? '#aaa' : '#007bff')}>
                  {saving ? 'Creating roles...' : 'Create Roles & Continue →'}
                </button>
                <button type="button" onClick={skipRoles} style={{ ...btn('#6c757d') }}>Skip</button>
              </div>
            </form>
          </div>
        )}

        {/* ── Step 2: Permissions ─────────────────────────────────────── */}
        {step === 2 && (
          <div style={{ background: 'white', padding: '28px', borderRadius: '8px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
            <h2 style={{ margin: '0 0 6px', fontSize: '18px' }}>Assign Permissions</h2>
            <p style={{ margin: '0 0 20px', color: '#666', fontSize: '14px' }}>Select which permissions each role has. Changes are saved immediately.</p>

            {createdRoles.length === 0 ? (
              <p style={{ color: '#999', fontSize: '14px', marginBottom: '24px' }}>No roles were created — skip to the next step.</p>
            ) : (
              <div style={{ display: 'flex', gap: '20px', minHeight: '360px' }}>
                {/* Role list */}
                <div style={{ width: '180px', flexShrink: 0 }}>
                  <p style={{ margin: '0 0 10px', fontSize: '12px', fontWeight: '600', color: '#888' }}>ROLES</p>
                  {createdRoles.map((role) => (
                    <div key={role.id} onClick={() => { setSelectedRoleId(role.id); setPermFilter(''); }}
                      style={{
                        padding: '10px 12px', borderRadius: '6px', cursor: 'pointer', marginBottom: '6px', fontSize: '14px', fontWeight: '500',
                        background: selectedRoleId === role.id ? '#e3f2fd' : '#f9f9f9',
                        border: selectedRoleId === role.id ? '1px solid #90caf9' : '1px solid transparent',
                        color: selectedRoleId === role.id ? '#1565c0' : '#333',
                      }}>
                      {role.name}
                      {role.is_default && <span style={{ fontSize: '10px', color: '#1565c0', marginLeft: '6px', opacity: 0.7 }}>default</span>}
                      <div style={{ fontSize: '11px', color: '#888', marginTop: '2px' }}>
                        {(rolePerms[role.id] || new Set()).size} perms
                      </div>
                    </div>
                  ))}
                </div>

                {/* Permission checkboxes */}
                <div style={{ flex: 1 }}>
                  {selectedRoleId && (
                    <>
                      <input
                        value={permFilter}
                        onChange={(e) => setPermFilter(e.target.value)}
                        placeholder="Filter permissions..."
                        style={{ ...inp, marginBottom: '12px', width: '100%' }}
                      />
                      {allPermissions.length > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                          <span style={{ fontSize: '12px', color: '#888' }}>
                            {(rolePerms[selectedRoleId] || new Set()).size} selected · {filteredPerms.length} shown
                          </span>
                          <button type="button" onClick={toggleAllPerms} disabled={permsSaving || filteredPerms.length === 0}
                            style={{ padding: '6px 12px', background: 'none', border: '1px solid #007bff', color: '#007bff', borderRadius: '4px', cursor: permsSaving || filteredPerms.length === 0 ? 'not-allowed' : 'pointer', fontSize: '12px', fontWeight: '600' }}>
                            {allFilteredSelected ? 'Deselect all' : 'Select all'}{permFilter ? ' (filtered)' : ''}
                          </button>
                        </div>
                      )}
                      {allPermissions.length === 0 ? (
                        <p style={{ color: '#999', fontSize: '14px' }}>No permissions defined yet. Create them in the Permissions page first.</p>
                      ) : (
                        <div style={{ maxHeight: '320px', overflowY: 'auto', border: '1px solid #f0f0f0', borderRadius: '6px' }}>
                          {filteredPerms.map((p) => {
                            const checked = (rolePerms[selectedRoleId] || new Set()).has(p.id);
                            return (
                              <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', borderBottom: '1px solid #f5f5f5', cursor: permsSaving ? 'wait' : 'pointer', background: checked ? '#f0fdf4' : 'white' }}>
                                <input type="checkbox" checked={checked} onChange={() => togglePerm(p.id)} disabled={permsSaving} />
                                <div>
                                  <span style={{ fontFamily: 'monospace', fontSize: '13px', fontWeight: '500' }}>{p.name || `${p.service}.${p.resource}:${p.action}`}</span>
                                  <span style={{ marginLeft: '8px', padding: '1px 6px', borderRadius: '10px', fontSize: '11px', background: p.action === 'delete' ? '#ffebee' : p.action === 'write' ? '#fff3e0' : '#e8f5e9', color: p.action === 'delete' ? '#c62828' : p.action === 'write' ? '#e65100' : '#2e7d32' }}>
                                    {p.action}
                                  </span>
                                  {p.description && <span style={{ marginLeft: '8px', fontSize: '12px', color: '#888' }}>{p.description}</span>}
                                </div>
                              </label>
                            );
                          })}
                          {filteredPerms.length === 0 && <p style={{ padding: '20px', color: '#999', textAlign: 'center', fontSize: '14px' }}>No permissions match</p>}
                        </div>
                      )}
                    </>
                  )}
                  {!selectedRoleId && <p style={{ color: '#999', fontSize: '14px' }}>Select a role to assign permissions.</p>}
                </div>
              </div>
            )}

            <div style={{ marginTop: '24px' }}>
              <button onClick={() => setStep(3)} style={btn()}>
                Continue to First User →
              </button>
            </div>
          </div>
        )}

        {/* ── Step 3: First user ──────────────────────────────────────── */}
        {step === 3 && (
          <div style={{ background: 'white', padding: '28px', borderRadius: '8px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
            <h2 style={{ margin: '0 0 6px', fontSize: '18px' }}>Create First User</h2>
            <p style={{ margin: '0 0 24px', color: '#666', fontSize: '14px' }}>
              Create the initial admin account for <strong>{clientName}</strong>. This user is pre-verified and can log in immediately.
            </p>
            <form onSubmit={handleCreateUser}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600', fontSize: '13px' }}>Full Name *</label>
                  <input value={userForm.name} onChange={(e) => setUserForm((f) => ({ ...f, name: e.target.value }))} required placeholder="Jane Doe" style={inp} />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600', fontSize: '13px' }}>Email *</label>
                  <input type="email" value={userForm.email} onChange={(e) => setUserForm((f) => ({ ...f, email: e.target.value }))} required placeholder="jane@acme.com" style={inp} />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600', fontSize: '13px' }}>Password *</label>
                  <input type="password" value={userForm.password} onChange={(e) => setUserForm((f) => ({ ...f, password: e.target.value }))} required placeholder="Min 8 chars" style={inp} />
                </div>
                {createdRoles.length > 0 && (
                  <div>
                    <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600', fontSize: '13px' }}>Assign Role</label>
                    <select value={userForm.role_id} onChange={(e) => setUserForm((f) => ({ ...f, role_id: e.target.value }))} style={inp}>
                      <option value="">No role</option>
                      {createdRoles.map((r) => (
                        <option key={r.id} value={r.id}>{r.name}{r.is_default ? ' (default)' : ''}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button type="submit" disabled={saving} style={btn(saving ? '#aaa' : '#007bff')}>
                  {saving ? 'Creating user...' : 'Create User & Finish →'}
                </button>
                <button type="button" onClick={skipUser} style={btn('#6c757d')}>Skip</button>
              </div>
            </form>
          </div>
        )}

        {/* ── Step 4: Done ───────────────────────────────────────────── */}
        {step === 4 && (
          <div style={{ background: 'white', padding: '36px', borderRadius: '8px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', textAlign: 'center' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>✓</div>
            <h2 style={{ margin: '0 0 8px', fontSize: '22px', color: '#28a745' }}>{clientName} is ready!</h2>
            <p style={{ color: '#666', fontSize: '14px', marginBottom: '24px' }}>
              Here&apos;s a summary of what was created:
            </p>
            <div style={{ textAlign: 'left', maxWidth: '420px', margin: '0 auto 28px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 16px', background: '#f9f9f9', borderRadius: '6px' }}>
                <span style={{ fontSize: '18px' }}>🏢</span>
                <div>
                  <div style={{ fontWeight: '600', fontSize: '14px' }}>{clientName}</div>
                  <div style={{ fontSize: '12px', color: '#888' }}>Client created</div>
                </div>
              </div>
              {createdRoles.length > 0 && (
                <div style={{ padding: '12px 16px', background: '#f9f9f9', borderRadius: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                    <span style={{ fontSize: '18px' }}>🎭</span>
                    <div style={{ fontWeight: '600', fontSize: '14px' }}>{createdRoles.length} role{createdRoles.length > 1 ? 's' : ''} created</div>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', paddingLeft: '28px' }}>
                    {createdRoles.map((r) => (
                      <span key={r.id} style={{ padding: '2px 8px', background: '#e3f2fd', color: '#1565c0', borderRadius: '10px', fontSize: '12px' }}>
                        {r.name}{r.is_default ? ' ★' : ''}
                        {(rolePerms[r.id] || new Set()).size > 0 && <span style={{ opacity: 0.7 }}> · {(rolePerms[r.id] || new Set()).size} perms</span>}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {createdUser && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 16px', background: '#f9f9f9', borderRadius: '6px' }}>
                  <span style={{ fontSize: '18px' }}>👤</span>
                  <div>
                    <div style={{ fontWeight: '600', fontSize: '14px' }}>{createdUser.name}</div>
                    <div style={{ fontSize: '12px', color: '#888' }}>{createdUser.email} · verified & ready to log in</div>
                  </div>
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button onClick={() => router.push('/superadmin')} style={btn()}>
                Go to Dashboard
              </button>
              <button onClick={() => {
                setStep(0); setClientId(null); setClientName('');
                setClientForm({ name: '', domain: '', description: '' });
                setRoleInputs([{ name: '', is_default: false }]);
                setCreatedRoles([]); setAllPermissions([]); setRolePerms({});
                setSelectedRoleId(null); setPermFilter('');
                setUserForm({ name: '', email: '', password: '', role_id: '' });
                setCreatedUser(null); setError('');
              }} style={btn('#6c757d')}>
                Onboard Another Client
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
