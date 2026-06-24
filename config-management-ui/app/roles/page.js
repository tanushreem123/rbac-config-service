'use client';
import { useState, useEffect } from 'react';
import Navbar from '../../components/Navbar';
import {
  listRoles, createRole, updateRole, assignRole,
  listRolePermissions, addPermissionToRole, removePermissionFromRole,
  listPermissions, listUsers,
} from '../../lib/RbacService';
import { getClientId, getContextId, isLoggedIn } from '../../lib/auth';
import { friendlyPermissionError, permissionLabel } from '../../lib/permissions';

export default function RolesPage() {
  const [roles, setRoles] = useState([]);
  const [allPermissions, setAllPermissions] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [authChecked, setAuthChecked] = useState(false);

  // create role form
  const [showCreate, setShowCreate] = useState(false);
  const [roleForm, setRoleForm] = useState({ name: '', description: '', isDefault: false, skipEmailVerification: false });
  const [saving, setSaving] = useState(false);

  // selected role for detail panel
  const [selectedRole, setSelectedRole] = useState(null);
  const [rolePerms, setRolePerms] = useState([]);
  const [loadingPerms, setLoadingPerms] = useState(false);

  // assign role
  const [assignUserId, setAssignUserId] = useState('');
  const [assigning, setAssigning] = useState(false);

  // add permission
  const [addPermId, setAddPermId] = useState('');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!isLoggedIn()) {
      window.location.replace('/login');
      return;
    }
    setAuthChecked(true);
  }, []);

  useEffect(() => {
    if (authChecked) loadAll();
  }, [authChecked]);

  const loadAll = async () => {
    setLoading(true);
    setError('');
    try {
      const clientId = getClientId();
      const [rolesData, permsData, usersData] = await Promise.all([
        listRoles(clientId),
        listPermissions(),
        listUsers(clientId),
      ]);
      setRoles(rolesData.roles || rolesData);
      setAllPermissions(permsData.permissions || permsData);
      setUsers(usersData.users || usersData);
    } catch (err) {
      setError(friendlyPermissionError(err.message));
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRole = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const clientId = getClientId();
      await createRole({ ...roleForm, clientId });
      setRoleForm({ name: '', description: '', isDefault: false, skipEmailVerification: false });
      setShowCreate(false);
      await loadAll();
    } catch (err) {
      setError(friendlyPermissionError(err.message));
    } finally {
      setSaving(false);
    }
  };

  const handleToggleSkipVerification = async (role) => {
    setError('');
    try {
      const updated = await updateRole(role.id, { skipEmailVerification: !role.skip_email_verification });
      setRoles(prev => prev.map(r => r.id === role.id ? { ...r, skip_email_verification: updated.role.skip_email_verification } : r));
      if (selectedRole?.id === role.id) setSelectedRole(prev => ({ ...prev, skip_email_verification: updated.role.skip_email_verification }));
    } catch (err) {
      setError(friendlyPermissionError(err.message));
    }
  };

  const handleSelectRole = async (role) => {
    setSelectedRole(role);
    setAssignUserId('');
    setAddPermId('');
    setLoadingPerms(true);
    try {
      const data = await listRolePermissions(role.id);
      setRolePerms(data.permissions || data);
    } catch (err) {
      setError(friendlyPermissionError(err.message));
    } finally {
      setLoadingPerms(false);
    }
  };

  const handleAssign = async () => {
    if (!assignUserId) return;
    setAssigning(true);
    setError('');
    try {
      const contextId = getContextId();
      await assignRole({ userId: assignUserId, roleId: selectedRole.id, contextId });
      setAssignUserId('');
      await loadAll();
    } catch (err) {
      setError(friendlyPermissionError(err.message));
    } finally {
      setAssigning(false);
    }
  };

  const handleAddPerm = async () => {
    if (!addPermId) return;
    setError('');
    try {
      await addPermissionToRole(selectedRole.id, addPermId);
      setAddPermId('');
      const data = await listRolePermissions(selectedRole.id);
      setRolePerms(data.permissions || data);
    } catch (err) {
      setError(friendlyPermissionError(err.message));
    }
  };

  const handleRemovePerm = async (permId) => {
    if (!window.confirm('Remove this permission from the role?')) return;
    setError('');
    try {
      await removePermissionFromRole(selectedRole.id, permId);
      const data = await listRolePermissions(selectedRole.id);
      setRolePerms(data.permissions || data);
    } catch (err) {
      setError(friendlyPermissionError(err.message));
    }
  };

  if (!authChecked) return null;

  const inputStyle = { width: '100%', padding: '8px 10px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '14px', boxSizing: 'border-box' };
  const assignedPermIds = new Set(rolePerms.map((p) => p.id));
  const unassignedPerms = allPermissions.filter((p) => !assignedPermIds.has(p.id));

  return (
    <div style={{ fontFamily: 'system-ui, -apple-system, sans-serif', minHeight: '100vh', background: '#fafafa' }}>
      <Navbar />
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 20px 40px' }}>
        {error && <div style={{ padding: '10px 14px', background: '#ffebee', color: '#c62828', borderRadius: '4px', marginBottom: '16px' }}>{error}</div>}

        <div style={{ display: 'flex', gap: '24px' }}>
          {/* Left: role list */}
          <div style={{ flex: '0 0 340px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ margin: 0 }}>Roles</h2>
              <button onClick={() => setShowCreate(!showCreate)} style={{ padding: '7px 14px', background: '#28a745', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: '600', fontSize: '13px' }}>
                {showCreate ? 'Cancel' : '+ New Role'}
              </button>
            </div>

            {showCreate && (
              <form onSubmit={handleCreateRole} style={{ background: 'white', padding: '16px', borderRadius: '6px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', marginBottom: '16px' }}>
                <div style={{ marginBottom: '12px' }}>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600', fontSize: '13px' }}>Role Name</label>
                  <input value={roleForm.name} onChange={(e) => setRoleForm((f) => ({ ...f, name: e.target.value }))} required placeholder="e.g. Admin" style={inputStyle} />
                </div>
                <div style={{ marginBottom: '12px' }}>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600', fontSize: '13px' }}>Description</label>
                  <input value={roleForm.description} onChange={(e) => setRoleForm((f) => ({ ...f, description: e.target.value }))} placeholder="Optional" style={inputStyle} />
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', marginBottom: '10px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={roleForm.isDefault} onChange={(e) => setRoleForm((f) => ({ ...f, isDefault: e.target.checked }))} />
                  Set as default role for new users
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', marginBottom: '14px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={roleForm.skipEmailVerification} onChange={(e) => setRoleForm((f) => ({ ...f, skipEmailVerification: e.target.checked }))} />
                  Skip email verification for users assigned this role
                </label>
                <button type="submit" disabled={saving} style={{ width: '100%', padding: '8px', background: saving ? '#aaa' : '#007bff', color: 'white', border: 'none', borderRadius: '4px', cursor: saving ? 'not-allowed' : 'pointer', fontWeight: '600' }}>
                  {saving ? 'Creating...' : 'Create Role'}
                </button>
              </form>
            )}

            {loading ? (
              <div style={{ padding: '30px', textAlign: 'center', color: '#999' }}>Loading...</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {roles.map((role) => (
                  <div
                    key={role.id}
                    onClick={() => handleSelectRole(role)}
                    style={{ padding: '14px 16px', background: 'white', borderRadius: '6px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', cursor: 'pointer', border: selectedRole?.id === role.id ? '2px solid #007bff' : '2px solid transparent' }}
                  >
                    <div style={{ fontWeight: '600', marginBottom: '4px' }}>{role.name}</div>
                    <div style={{ fontSize: '12px', color: '#666', marginBottom: '8px' }}>{role.description || 'No description'}</div>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      {role.is_default && <span style={{ fontSize: '11px', color: '#1565c0', background: '#e3f2fd', padding: '2px 6px', borderRadius: '10px' }}>Default</span>}
                      <span
                        onClick={e => { e.stopPropagation(); handleToggleSkipVerification(role); }}
                        title="Toggle email verification requirement"
                        style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '10px', cursor: 'pointer', fontWeight: '600',
                          background: role.skip_email_verification ? '#e8f5e9' : '#fff3e0',
                          color: role.skip_email_verification ? '#2e7d32' : '#e65100',
                          border: `1px solid ${role.skip_email_verification ? '#c8e6c9' : '#ffe0b2'}` }}>
                        {role.skip_email_verification ? 'No email verify' : 'Email required'}
                      </span>
                    </div>
                  </div>
                ))}
                {roles.length === 0 && <div style={{ padding: '20px', textAlign: 'center', color: '#999', fontSize: '14px' }}>No roles yet</div>}
              </div>
            )}
          </div>

          {/* Right: role detail */}
          {selectedRole ? (
            <div style={{ flex: 1 }}>
              <h2 style={{ margin: '0 0 20px' }}>
                {selectedRole.name}
                {selectedRole.is_default && <span style={{ fontSize: '13px', color: '#1565c0', background: '#e3f2fd', padding: '3px 8px', borderRadius: '10px', marginLeft: '10px', fontWeight: '400' }}>Default</span>}
              </h2>

              {/* Assign to user */}
              <div style={{ background: 'white', padding: '20px', borderRadius: '6px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', marginBottom: '20px' }}>
                <h4 style={{ margin: '0 0 14px' }}>Assign to User</h4>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <select value={assignUserId} onChange={(e) => setAssignUserId(e.target.value)} style={{ ...inputStyle, flex: 1 }}>
                    <option value="">Select a user...</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>{u.email}{u.name ? ` (${u.name})` : ''}</option>
                    ))}
                  </select>
                  <button onClick={handleAssign} disabled={!assignUserId || assigning} style={{ padding: '8px 18px', background: !assignUserId || assigning ? '#aaa' : '#007bff', color: 'white', border: 'none', borderRadius: '4px', cursor: !assignUserId || assigning ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap', fontWeight: '600' }}>
                    {assigning ? 'Assigning...' : 'Assign'}
                  </button>
                </div>
              </div>

              {/* Permissions on this role */}
              <div style={{ background: 'white', padding: '20px', borderRadius: '6px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
                <h4 style={{ margin: '0 0 14px' }}>Permissions</h4>

                {unassignedPerms.length > 0 && (
                  <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
                    <select value={addPermId} onChange={(e) => setAddPermId(e.target.value)} style={{ ...inputStyle, flex: 1 }}>
                      <option value="">Add a permission...</option>
                      {unassignedPerms.map((p) => (
                        <option key={p.id} value={p.id}>{permissionLabel(p)}</option>
                      ))}
                    </select>
                    <button onClick={handleAddPerm} disabled={!addPermId} style={{ padding: '8px 18px', background: !addPermId ? '#aaa' : '#28a745', color: 'white', border: 'none', borderRadius: '4px', cursor: !addPermId ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap', fontWeight: '600' }}>
                      Add
                    </button>
                  </div>
                )}

                {loadingPerms ? (
                  <div style={{ padding: '20px', textAlign: 'center', color: '#999' }}>Loading...</div>
                ) : rolePerms.length === 0 ? (
                  <div style={{ padding: '16px', textAlign: 'center', color: '#999', fontSize: '14px' }}>No permissions assigned</div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid #f0f0f0' }}>
                        <th style={th}>Name</th>
                        <th style={th}>Resource</th>
                        <th style={th}>Action</th>
                        <th style={th}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {rolePerms.map((p) => (
                        <tr key={p.id} style={{ borderBottom: '1px solid #f5f5f5' }}>
                          <td style={{ ...td, fontFamily: 'monospace' }}>{permissionLabel(p)}</td>
                          <td style={td}>{p.resource}</td>
                          <td style={td}>
                            <span style={{ padding: '2px 8px', borderRadius: '12px', fontSize: '12px', background: p.action === 'delete' ? '#ffebee' : p.action === 'write' ? '#fff3e0' : '#e8f5e9', color: p.action === 'delete' ? '#c62828' : p.action === 'write' ? '#e65100' : '#2e7d32' }}>
                              {p.action}
                            </span>
                          </td>
                          <td style={td}>
                            <button onClick={() => handleRemovePerm(p.id)} style={{ padding: '4px 10px', background: 'transparent', color: '#d32f2f', border: '1px solid #d32f2f', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>
                              Remove
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          ) : (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999', fontSize: '15px' }}>
              ← Select a role to manage it
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const th = { padding: '10px 14px', textAlign: 'left', fontWeight: '600', fontSize: '13px' };
const td = { padding: '10px 14px', fontSize: '14px' };
