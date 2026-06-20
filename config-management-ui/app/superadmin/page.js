'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { isSuperadminLoggedIn, getSuperadminInfo, superadminLogout } from '../../lib/superadminAuth';
import {
  listClients, createClient, updateClient,
  getClientUsers, getClientRoles, createClientRole,
  listAllPermissions, getClientRolePermissions,
  addClientRolePermission, removeClientRolePermission,
} from '../../lib/SuperadminService';

const DETAIL_TABS = ['Users', 'Roles & Permissions'];

export default function SuperadminDashboard() {
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);
  const [clients, setClients] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState(0);

  // Create client
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ name: '', domain: '', description: '' });
  const [creating, setCreating] = useState(false);

  // Domain edit
  const [editingDomain, setEditingDomain] = useState(null);
  const [domainValue, setDomainValue] = useState('');
  const [savingDomain, setSavingDomain] = useState(false);

  // Users tab
  const [clientUsers, setClientUsers] = useState([]);

  // Roles & Permissions tab
  const [clientRoles, setClientRoles] = useState([]);
  const [selectedRole, setSelectedRole] = useState(null);
  const [allPermissions, setAllPermissions] = useState([]);
  const [rolePermsMap, setRolePermsMap] = useState({});  // { roleId: [{id, ...}] }
  const [loadingPerms, setLoadingPerms] = useState(false);
  const [permToggling, setPermToggling] = useState(false);
  const [permFilter, setPermFilter] = useState('');

  // Create role
  const [showRoleForm, setShowRoleForm] = useState(false);
  const [roleForm, setRoleForm] = useState({ name: '', is_default: false });
  const [savingRole, setSavingRole] = useState(false);

  const [loadingDetail, setLoadingDetail] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!isSuperadminLoggedIn()) { window.location.replace('/superadmin/login'); return; }
    setAuthChecked(true);
  }, []);

  useEffect(() => {
    if (authChecked) load();
  }, [authChecked]);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await listClients();
      setClients(data.clients || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectClient = async (client) => {
    setSelected(client);
    setActiveTab(0);
    setSelectedRole(null);
    setRolePermsMap({});
    setShowRoleForm(false);
    setPermFilter('');
    setLoadingDetail(true);
    try {
      const [usersData, rolesData] = await Promise.all([getClientUsers(client.id), getClientRoles(client.id)]);
      setClientUsers(usersData.users || []);
      setClientRoles(rolesData.roles || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleTabChange = async (tabIndex) => {
    setActiveTab(tabIndex);
    if (tabIndex === 1 && allPermissions.length === 0) {
      try {
        const data = await listAllPermissions();
        setAllPermissions(data.permissions || []);
      } catch {}
    }
  };

  const handleSelectRole = async (role) => {
    setSelectedRole(role);
    setPermFilter('');
    if (rolePermsMap[role.id]) return;
    setLoadingPerms(true);
    try {
      const data = await getClientRolePermissions(selected.id, role.id);
      setRolePermsMap((m) => ({ ...m, [role.id]: data.permissions || [] }));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingPerms(false);
    }
  };

  const handleTogglePerm = async (perm) => {
    if (!selectedRole || permToggling) return;
    setPermToggling(true);
    setError('');
    const current = rolePermsMap[selectedRole.id] || [];
    const isAssigned = current.some((p) => p.id === perm.id);
    try {
      if (isAssigned) {
        await removeClientRolePermission(selected.id, selectedRole.id, perm.id);
        setRolePermsMap((m) => ({ ...m, [selectedRole.id]: current.filter((p) => p.id !== perm.id) }));
      } else {
        await addClientRolePermission(selected.id, selectedRole.id, perm.id);
        setRolePermsMap((m) => ({ ...m, [selectedRole.id]: [...current, perm] }));
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setPermToggling(false);
    }
  };

  const handleCreateRole = async (e) => {
    e.preventDefault();
    setSavingRole(true);
    setError('');
    try {
      const data = await createClientRole(selected.id, roleForm);
      setClientRoles((r) => [...r, data.role]);
      setRoleForm({ name: '', is_default: false });
      setShowRoleForm(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingRole(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setCreating(true);
    setError('');
    try {
      await createClient(createForm);
      setCreateForm({ name: '', domain: '', description: '' });
      setShowCreate(false);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  };

  const handleSaveDomain = async (clientId) => {
    setSavingDomain(true);
    setError('');
    try {
      await updateClient(clientId, { domain: domainValue });
      setEditingDomain(null);
      await load();
      if (selected?.id === clientId) setSelected((s) => ({ ...s, domain: domainValue }));
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingDomain(false);
    }
  };

  const handleLogout = async () => {
    await superadminLogout();
    window.location.replace('/superadmin/login');
  };

  if (!authChecked) return null;

  const admin = getSuperadminInfo();
  const inp = { width: '100%', padding: '8px 10px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '14px', boxSizing: 'border-box' };

  const filteredPerms = allPermissions.filter((p) => {
    if (!permFilter) return true;
    const q = permFilter.toLowerCase();
    return p.service?.toLowerCase().includes(q) || p.resource?.toLowerCase().includes(q) || p.action?.toLowerCase().includes(q);
  });
  const assignedPermIds = new Set((rolePermsMap[selectedRole?.id] || []).map((p) => p.id));

  return (
    <div style={{ fontFamily: 'system-ui, -apple-system, sans-serif', minHeight: '100vh', background: '#fafafa' }}>
      <nav style={{ background: '#1a1a2e', color: 'white', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '56px' }}>
        <span style={{ fontWeight: '700', fontSize: '15px' }}>⚡ Platform Admin</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button onClick={() => router.push('/superadmin/onboarding')}
            style={{ padding: '6px 14px', background: '#28a745', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}>
            + Onboard Client
          </button>
          <span style={{ fontSize: '13px', color: '#aaa' }}>{admin?.email}</span>
          <button onClick={handleLogout} style={{ padding: '6px 14px', background: 'transparent', color: '#ccc', border: '1px solid #444', borderRadius: '4px', cursor: 'pointer', fontSize: '13px' }}>Logout</button>
        </div>
      </nav>

      <div style={{ maxWidth: '1400px', margin: '32px auto', padding: '0 20px 40px', display: 'flex', gap: '24px' }}>
        {/* Left: client list */}
        <div style={{ flex: '0 0 340px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h2 style={{ margin: 0 }}>Clients</h2>
            <button onClick={() => setShowCreate(!showCreate)}
              style={{ padding: '7px 14px', background: showCreate ? '#6c757d' : '#007bff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: '600', fontSize: '13px' }}>
              {showCreate ? 'Cancel' : '+ Quick Add'}
            </button>
          </div>

          {error && <div style={{ padding: '10px 14px', background: '#ffebee', color: '#c62828', borderRadius: '4px', marginBottom: '16px', fontSize: '13px' }}>{error}</div>}

          {showCreate && (
            <form onSubmit={handleCreate} style={{ background: 'white', padding: '16px', borderRadius: '6px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', marginBottom: '16px' }}>
              <div style={{ marginBottom: '10px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontWeight: '600', fontSize: '12px' }}>Client Name *</label>
                <input value={createForm.name} onChange={(e) => setCreateForm(f => ({ ...f, name: e.target.value }))} required placeholder="Acme Corp" style={inp} />
              </div>
              <div style={{ marginBottom: '10px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontWeight: '600', fontSize: '12px' }}>Domain</label>
                <input value={createForm.domain} onChange={(e) => setCreateForm(f => ({ ...f, domain: e.target.value }))} placeholder="acme.example.com" style={inp} />
              </div>
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontWeight: '600', fontSize: '12px' }}>Description</label>
                <input value={createForm.description} onChange={(e) => setCreateForm(f => ({ ...f, description: e.target.value }))} placeholder="Optional" style={inp} />
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button type="submit" disabled={creating} style={{ flex: 1, padding: '8px', background: creating ? '#aaa' : '#007bff', color: 'white', border: 'none', borderRadius: '4px', fontWeight: '600', cursor: creating ? 'not-allowed' : 'pointer', fontSize: '13px' }}>
                  {creating ? 'Creating...' : 'Create'}
                </button>
                <button type="button" onClick={() => router.push('/superadmin/onboarding')}
                  style={{ flex: 1, padding: '8px', background: '#e8f5e9', color: '#2e7d32', border: '1px solid #a5d6a7', borderRadius: '4px', fontWeight: '600', cursor: 'pointer', fontSize: '13px' }}>
                  Full Wizard →
                </button>
              </div>
            </form>
          )}

          {loading ? (
            <div style={{ padding: '30px', textAlign: 'center', color: '#999' }}>Loading...</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {clients.map((c) => (
                <div key={c.id} onClick={() => handleSelectClient(c)}
                  style={{ padding: '14px 16px', background: 'white', borderRadius: '6px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', cursor: 'pointer', border: selected?.id === c.id ? '2px solid #007bff' : '2px solid transparent' }}>
                  <div style={{ fontWeight: '600', marginBottom: '4px' }}>{c.name}</div>
                  <div style={{ fontSize: '12px', color: '#888', marginBottom: '4px' }}>
                    {c.domain ? <span style={{ color: '#1565c0' }}>{c.domain}</span> : <span style={{ color: '#bbb' }}>No domain set</span>}
                  </div>
                  <div style={{ fontSize: '12px', color: '#999' }}>{c.user_count} users · {c.role_count} roles</div>
                </div>
              ))}
              {clients.length === 0 && <div style={{ padding: '20px', textAlign: 'center', color: '#999', fontSize: '14px' }}>No clients yet</div>}
            </div>
          )}
        </div>

        {/* Right: client detail */}
        {selected ? (
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
              <div>
                <h2 style={{ margin: '0 0 4px' }}>{selected.name}</h2>
                {selected.description && <p style={{ margin: 0, color: '#666', fontSize: '14px' }}>{selected.description}</p>}
              </div>
            </div>

            {/* Domain config */}
            <div style={{ background: 'white', padding: '16px 20px', borderRadius: '6px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '13px', fontWeight: '600', color: '#555', whiteSpace: 'nowrap' }}>Domain:</span>
                {editingDomain === selected.id ? (
                  <>
                    <input value={domainValue} onChange={(e) => setDomainValue(e.target.value)} placeholder="e.g. acme.example.com" style={{ ...inp, flex: 1 }} />
                    <button onClick={() => handleSaveDomain(selected.id)} disabled={savingDomain} style={{ padding: '7px 14px', background: '#28a745', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', whiteSpace: 'nowrap', fontSize: '13px' }}>
                      {savingDomain ? 'Saving...' : 'Save'}
                    </button>
                    <button onClick={() => setEditingDomain(null)} style={{ padding: '7px 12px', background: '#6c757d', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '13px' }}>Cancel</button>
                  </>
                ) : (
                  <>
                    <code style={{ background: '#f5f5f5', padding: '5px 10px', borderRadius: '4px', fontSize: '13px', flex: 1 }}>
                      {selected.domain || 'Not set'}
                    </code>
                    <button onClick={() => { setEditingDomain(selected.id); setDomainValue(selected.domain || ''); }}
                      style={{ padding: '6px 12px', background: '#007bff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '13px', whiteSpace: 'nowrap' }}>
                      Edit
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', borderBottom: '2px solid #e0e0e0', marginBottom: '20px' }}>
              {DETAIL_TABS.map((tab, i) => (
                <button key={i} onClick={() => handleTabChange(i)}
                  style={{ padding: '10px 20px', background: 'none', border: 'none', borderBottom: activeTab === i ? '2px solid #007bff' : '2px solid transparent', marginBottom: '-2px', cursor: 'pointer', fontWeight: activeTab === i ? '600' : '400', color: activeTab === i ? '#007bff' : '#555', fontSize: '14px' }}>
                  {tab}
                </button>
              ))}
            </div>

            {loadingDetail ? (
              <div style={{ padding: '40px', textAlign: 'center', color: '#999' }}>Loading...</div>
            ) : (
              <>
                {/* ── Users tab ─────────────────────────────── */}
                {activeTab === 0 && (
                  <div style={{ background: 'white', padding: '20px', borderRadius: '6px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
                    <h4 style={{ margin: '0 0 14px' }}>Users ({clientUsers.length})</h4>
                    {clientUsers.length === 0 ? (
                      <p style={{ color: '#999', fontSize: '14px' }}>No users yet. Use the onboarding wizard to create the first user.</p>
                    ) : (
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr style={{ borderBottom: '2px solid #f0f0f0' }}>
                            {['Name', 'Email', 'Verified', 'Roles'].map((h) => (
                              <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#666' }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {clientUsers.map((u) => (
                            <tr key={u.id} style={{ borderBottom: '1px solid #f5f5f5' }}>
                              <td style={{ padding: '10px 12px', fontSize: '14px' }}>{u.name || '—'}</td>
                              <td style={{ padding: '10px 12px', fontSize: '14px' }}>{u.email}</td>
                              <td style={{ padding: '10px 12px' }}>
                                <span style={{ padding: '2px 7px', borderRadius: '10px', fontSize: '11px', background: u.is_email_verified ? '#e8f5e9' : '#fff3e0', color: u.is_email_verified ? '#2e7d32' : '#e65100' }}>
                                  {u.is_email_verified ? 'Verified' : 'Pending'}
                                </span>
                              </td>
                              <td style={{ padding: '10px 12px', fontSize: '13px' }}>
                                {u.roles?.filter(Boolean).join(', ') || <span style={{ color: '#bbb' }}>None</span>}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}

                {/* ── Roles & Permissions tab ───────────────── */}
                {activeTab === 1 && (
                  <div style={{ display: 'flex', gap: '20px' }}>
                    {/* Role list */}
                    <div style={{ width: '220px', flexShrink: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                        <span style={{ fontSize: '12px', fontWeight: '600', color: '#888' }}>ROLES</span>
                        <button onClick={() => setShowRoleForm(!showRoleForm)}
                          style={{ padding: '4px 10px', background: showRoleForm ? '#6c757d' : '#28a745', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: '600' }}>
                          {showRoleForm ? 'Cancel' : '+ Add'}
                        </button>
                      </div>

                      {showRoleForm && (
                        <form onSubmit={handleCreateRole} style={{ background: 'white', padding: '12px', borderRadius: '6px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', marginBottom: '10px' }}>
                          <input value={roleForm.name} onChange={(e) => setRoleForm((f) => ({ ...f, name: e.target.value }))} required placeholder="Role name" style={{ ...inp, marginBottom: '8px' }} />
                          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', marginBottom: '10px', cursor: 'pointer' }}>
                            <input type="checkbox" checked={roleForm.is_default} onChange={(e) => setRoleForm((f) => ({ ...f, is_default: e.target.checked }))} />
                            Default role
                          </label>
                          <button type="submit" disabled={savingRole} style={{ width: '100%', padding: '7px', background: savingRole ? '#aaa' : '#007bff', color: 'white', border: 'none', borderRadius: '4px', cursor: savingRole ? 'not-allowed' : 'pointer', fontWeight: '600', fontSize: '13px' }}>
                            {savingRole ? 'Creating...' : 'Create'}
                          </button>
                        </form>
                      )}

                      {clientRoles.length === 0 ? (
                        <p style={{ color: '#999', fontSize: '13px', padding: '10px 0' }}>No roles yet.</p>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          {clientRoles.map((role) => (
                            <div key={role.id} onClick={() => handleSelectRole(role)}
                              style={{
                                padding: '10px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '14px', fontWeight: '500',
                                background: selectedRole?.id === role.id ? '#e3f2fd' : 'white',
                                border: selectedRole?.id === role.id ? '1px solid #90caf9' : '1px solid #e0e0e0',
                                color: selectedRole?.id === role.id ? '#1565c0' : '#333',
                                boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                              }}>
                              {role.name}
                              {role.is_default && <span style={{ fontSize: '10px', background: '#e3f2fd', color: '#1565c0', padding: '1px 5px', borderRadius: '8px', marginLeft: '6px' }}>default</span>}
                              {rolePermsMap[role.id] && (
                                <div style={{ fontSize: '11px', color: '#888', marginTop: '2px' }}>
                                  {rolePermsMap[role.id].length} permission{rolePermsMap[role.id].length !== 1 ? 's' : ''}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Permission panel */}
                    <div style={{ flex: 1, background: 'white', padding: '20px', borderRadius: '6px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
                      {!selectedRole ? (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '200px', color: '#bbb', fontSize: '14px' }}>
                          ← Select a role to manage its permissions
                        </div>
                      ) : loadingPerms ? (
                        <div style={{ padding: '40px', textAlign: 'center', color: '#999' }}>Loading permissions...</div>
                      ) : (
                        <>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                            <h4 style={{ margin: 0 }}>{selectedRole.name} — Permissions</h4>
                            <span style={{ fontSize: '13px', color: '#666' }}>{assignedPermIds.size} / {allPermissions.length} assigned</span>
                          </div>

                          {allPermissions.length === 0 ? (
                            <p style={{ color: '#999', fontSize: '14px' }}>No global permissions defined yet. Go to the Permissions page to create them.</p>
                          ) : (
                            <>
                              <input value={permFilter} onChange={(e) => setPermFilter(e.target.value)} placeholder="Filter by service, resource, or action..." style={{ ...inp, marginBottom: '12px' }} />
                              <div style={{ maxHeight: '420px', overflowY: 'auto', border: '1px solid #f0f0f0', borderRadius: '6px' }}>
                                {filteredPerms.map((p) => {
                                  const checked = assignedPermIds.has(p.id);
                                  return (
                                    <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', borderBottom: '1px solid #f5f5f5', cursor: permToggling ? 'wait' : 'pointer', background: checked ? '#f0fdf4' : 'white' }}>
                                      <input type="checkbox" checked={checked} onChange={() => handleTogglePerm(p)} disabled={permToggling} />
                                      <div style={{ flex: 1 }}>
                                        <span style={{ fontFamily: 'monospace', fontSize: '13px', fontWeight: '500' }}>{p.service}.{p.resource}</span>
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
                            </>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        ) : (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '16px', color: '#bbb' }}>
            <div style={{ fontSize: '48px' }}>🏢</div>
            <div style={{ fontSize: '15px' }}>Select a client to manage it</div>
            <button onClick={() => router.push('/superadmin/onboarding')}
              style={{ padding: '10px 22px', background: '#28a745', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: '600', fontSize: '14px' }}>
              + Onboard New Client
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
