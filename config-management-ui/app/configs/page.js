'use client';
import { useState, useEffect, useCallback } from 'react';
import Navbar from '../../components/Navbar';
import { isLoggedIn } from '../../lib/auth';
import { fetchMyPermissions, friendlyPermissionError } from '../../lib/permissions';
import {
  fetchConfigs, createConfig, deleteConfig,
  fetchConfigVersions, rollbackConfig,
} from '../../lib/ConfigService';

const ENVS = ['dev', 'staging', 'prod'];
const TYPES = ['string', 'boolean', 'number', 'json'];

const TYPE_COLORS = {
  string:  { bg: '#e8f5e9', color: '#2e7d32' },
  boolean: { bg: '#e3f2fd', color: '#1565c0' },
  number:  { bg: '#fff3e0', color: '#e65100' },
  json:    { bg: '#f3e5f5', color: '#6a1b9a' },
};

function formatValue(value, type) {
  if (type === 'json') {
    try { return JSON.stringify(value, null, 2); } catch { return String(value); }
  }
  if (type === 'boolean') return value ? 'true' : 'false';
  return String(value ?? '');
}

function timeAgo(dateStr) {
  if (!dateStr) return '—';
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function ConfigsPage() {
  const [authChecked, setAuthChecked] = useState(false);
  const [myPerms, setMyPerms] = useState(new Set());
  const [activeEnv, setActiveEnv] = useState('dev');
  const [configs, setConfigs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Create form
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ key: '', value: '', type: 'string', environment: 'dev' });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  // Inline edit
  const [editingKey, setEditingKey] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [editSaving, setEditSaving] = useState(false);

  // Version history panel
  const [selectedConfig, setSelectedConfig] = useState(null);
  const [versions, setVersions] = useState([]);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [rolling, setRolling] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!isLoggedIn()) { window.location.replace('/login'); return; }
    setAuthChecked(true);
    fetchMyPermissions().then(setMyPerms);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setConfigs(await fetchConfigs(activeEnv));
    } catch (err) {
      setError(friendlyPermissionError(err.message));
    } finally {
      setLoading(false);
    }
  }, [activeEnv]);

  useEffect(() => { if (authChecked) load(); }, [authChecked, load]);

  // ── Create ──────────────────────────────────────────────────────────────────

  const handleCreate = async (e) => {
    e.preventDefault();
    setSaving(true);
    setFormError('');
    try {
      await createConfig(form);
      setForm({ key: '', value: '', type: 'string', environment: activeEnv });
      setShowForm(false);
      await load();
    } catch (err) {
      setFormError(friendlyPermissionError(err.message));
    } finally {
      setSaving(false);
    }
  };

  // ── Inline edit ─────────────────────────────────────────────────────────────

  const startEdit = (cfg, e) => {
    e.stopPropagation();
    setEditingKey(cfg.key);
    setEditValue(cfg.type === 'json' ? JSON.stringify(cfg.value, null, 2) : formatValue(cfg.value, cfg.type));
  };

  const cancelEdit = (e) => {
    e?.stopPropagation();
    setEditingKey(null);
    setEditValue('');
  };

  const saveEdit = async (cfg, e) => {
    e.stopPropagation();
    setEditSaving(true);
    setError('');
    try {
      await createConfig({ key: cfg.key, environment: cfg.environment, value: editValue, type: cfg.type });
      setEditingKey(null);
      await load();
      // refresh version panel if this config is open
      if (selectedConfig?.key === cfg.key) {
        const v = await fetchConfigVersions(cfg.key, cfg.environment);
        setVersions(v);
        setSelectedConfig(prev => ({ ...prev, value: editValue }));
      }
    } catch (err) {
      setError(friendlyPermissionError(err.message));
    } finally {
      setEditSaving(false);
    }
  };

  // ── Delete ──────────────────────────────────────────────────────────────────

  const handleDelete = async (cfg, e) => {
    e.stopPropagation();
    if (!window.confirm(`Delete "${cfg.key}" from ${cfg.environment}? All versions will be removed.`)) return;
    try {
      await deleteConfig(cfg.key, cfg.environment);
      if (selectedConfig?.key === cfg.key) setSelectedConfig(null);
      await load();
    } catch (err) {
      setError(friendlyPermissionError(err.message));
    }
  };

  // ── Version history ─────────────────────────────────────────────────────────

  const handleSelectConfig = async (cfg) => {
    if (editingKey) return; // don't open panel while editing
    setSelectedConfig(cfg);
    setVersions([]);
    setLoadingVersions(true);
    try {
      setVersions(await fetchConfigVersions(cfg.key, cfg.environment));
    } catch (err) {
      setError(friendlyPermissionError(err.message));
    } finally {
      setLoadingVersions(false);
    }
  };

  const handleRollback = async (targetVersion) => {
    if (!window.confirm(`Roll back "${selectedConfig.key}" to v${targetVersion}?`)) return;
    setRolling(true);
    try {
      await rollbackConfig({ key: selectedConfig.key, environment: selectedConfig.environment, targetVersion });
      await load();
      const v = await fetchConfigVersions(selectedConfig.key, selectedConfig.environment);
      setVersions(v);
      setSelectedConfig(prev => ({ ...prev, version: targetVersion }));
    } catch (err) {
      setError(friendlyPermissionError(err.message));
    } finally {
      setRolling(false);
    }
  };

  const canWrite = myPerms.has('config:write');
  const canDelete = myPerms.has('config:delete');
  if (!authChecked) return null;

  const set = (f) => (e) => setForm(prev => ({ ...prev, [f]: e.target.value }));

  const filteredConfigs = searchQuery.trim()
    ? configs.filter(c => c.key.toLowerCase().includes(searchQuery.toLowerCase()))
    : configs;

  return (
    <div style={{ fontFamily: 'system-ui, -apple-system, sans-serif', minHeight: '100vh', background: '#f4f6f9' }}>
      <Navbar />
      <div style={{ maxWidth: '1300px', margin: '0 auto', padding: '0 24px 48px' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '22px', fontWeight: '700', color: '#1a1a2e' }}>Configurations</h1>
            <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#888' }}>Manage feature flags and runtime config values per environment</p>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={() => window.location.href = '/api-keys'}
              style={{ padding: '8px 16px', background: 'white', color: '#555', border: '1px solid #ddd', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: '500' }}>
              API Keys
            </button>
            {canWrite && (
              <button onClick={() => { setShowForm(!showForm); setFormError(''); setForm(f => ({ ...f, environment: activeEnv })); }}
                style={{ padding: '8px 18px', background: showForm ? '#6c757d' : '#1a1a2e', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}>
                {showForm ? 'Cancel' : '+ New Config'}
              </button>
            )}
          </div>
        </div>

        {error && (
          <div style={{ padding: '12px 16px', background: '#ffebee', color: '#c62828', borderRadius: '6px', marginBottom: '16px', fontSize: '14px' }}>{error}</div>
        )}

        {/* Create form */}
        {showForm && (
          <div style={{ background: 'white', borderRadius: '10px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', padding: '24px', marginBottom: '24px' }}>
            <h3 style={{ margin: '0 0 20px', fontSize: '15px', fontWeight: '700', color: '#1a1a2e' }}>New Configuration</h3>
            {formError && <div style={{ padding: '10px 14px', background: '#ffebee', color: '#c62828', borderRadius: '6px', marginBottom: '16px', fontSize: '13px' }}>{formError}</div>}
            <form onSubmit={handleCreate}>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <div>
                  <label style={labelStyle}>Key</label>
                  <input value={form.key} onChange={set('key')} required placeholder="e.g. feature.payment_v2" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Type</label>
                  <select value={form.type} onChange={set('type')} style={inputStyle}>
                    {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Environment</label>
                  <select value={form.environment} onChange={set('environment')} style={inputStyle}>
                    {ENVS.map(e => <option key={e} value={e}>{e}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ marginBottom: '20px' }}>
                <label style={labelStyle}>Value</label>
                {form.type === 'boolean' ? (
                  <select value={form.value} onChange={set('value')} style={inputStyle}>
                    <option value="true">true</option>
                    <option value="false">false</option>
                  </select>
                ) : form.type === 'json' ? (
                  <textarea value={form.value} onChange={set('value')} required placeholder='{"key": "value"}' rows={4}
                    style={{ ...inputStyle, fontFamily: 'monospace', resize: 'vertical' }} />
                ) : (
                  <input value={form.value} onChange={set('value')} required
                    placeholder={form.type === 'number' ? '42' : 'value'}
                    type={form.type === 'number' ? 'number' : 'text'}
                    style={inputStyle} />
                )}
              </div>
              <button type="submit" disabled={saving}
                style={{ padding: '9px 22px', background: saving ? '#aaa' : '#1a1a2e', color: 'white', border: 'none', borderRadius: '6px', cursor: saving ? 'not-allowed' : 'pointer', fontWeight: '600', fontSize: '14px' }}>
                {saving ? 'Saving…' : 'Create Config'}
              </button>
            </form>
          </div>
        )}

        {/* Env tabs + search row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ display: 'flex', gap: '4px' }}>
            {ENVS.map(env => (
              <button key={env} onClick={() => { setActiveEnv(env); setSelectedConfig(null); setSearchQuery(''); cancelEdit(); }}
                style={{
                  padding: '7px 20px', border: 'none', borderRadius: '20px', cursor: 'pointer',
                  fontSize: '13px', fontWeight: activeEnv === env ? '700' : '500',
                  background: activeEnv === env
                    ? (env === 'prod' ? '#d32f2f' : env === 'staging' ? '#f0a500' : '#1a1a2e')
                    : 'white',
                  color: activeEnv === env ? 'white' : '#666',
                  boxShadow: activeEnv === env ? '0 2px 6px rgba(0,0,0,0.15)' : '0 1px 3px rgba(0,0,0,0.08)',
                }}>
                {env.toUpperCase()}
                {activeEnv === env && configs.length > 0 && (
                  <span style={{ marginLeft: '6px', fontSize: '11px', opacity: 0.8 }}>({filteredConfigs.length}{searchQuery ? `/${configs.length}` : ''})</span>
                )}
              </button>
            ))}
          </div>

          {/* Search */}
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#aaa', fontSize: '14px', pointerEvents: 'none' }}>🔍</span>
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Filter by key…"
              style={{ padding: '7px 12px 7px 32px', border: '1px solid #e0e0e0', borderRadius: '20px', fontSize: '13px', outline: 'none', background: 'white', width: '220px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')}
                style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#aaa', cursor: 'pointer', fontSize: '14px', lineHeight: 1, padding: 0 }}>×</button>
            )}
          </div>
        </div>

        {/* Main content: table + side panel */}
        <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
          {/* Config table */}
          <div style={{ flex: 1, background: 'white', borderRadius: '10px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
            {loading ? (
              <div style={{ padding: '60px', textAlign: 'center', color: '#aaa', fontSize: '14px' }}>Loading configs…</div>
            ) : filteredConfigs.length === 0 ? (
              <div style={{ padding: '60px', textAlign: 'center' }}>
                <div style={{ fontSize: '32px', marginBottom: '12px' }}>{searchQuery ? '🔍' : '📭'}</div>
                <div style={{ color: '#999', fontSize: '14px' }}>
                  {searchQuery ? `No configs match "${searchQuery}"` : `No configs in ${activeEnv} yet`}
                </div>
                {!searchQuery && canWrite && <div style={{ color: '#bbb', fontSize: '13px', marginTop: '6px' }}>Click "+ New Config" to add one</div>}
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f8f9fa', borderBottom: '2px solid #eee' }}>
                    <th style={th}>Key</th>
                    <th style={th}>Type</th>
                    <th style={th}>Value</th>
                    <th style={th}>Version</th>
                    <th style={th}>Updated</th>
                    <th style={th}></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredConfigs.map(cfg => {
                    const isSelected = selectedConfig?.key === cfg.key;
                    const isEditing = editingKey === cfg.key;
                    const tc = TYPE_COLORS[cfg.type] || TYPE_COLORS.string;

                    return (
                      <tr key={cfg.key}
                        onClick={() => !isEditing && handleSelectConfig(cfg)}
                        style={{ borderBottom: '1px solid #f0f0f0', cursor: isEditing ? 'default' : 'pointer', background: isEditing ? '#fffdf0' : isSelected ? '#f0f4ff' : 'white', transition: 'background 0.1s' }}>

                        <td style={{ ...td, fontFamily: 'monospace', fontWeight: '600', color: '#1a1a2e' }}>{cfg.key}</td>
                        <td style={td}>
                          <span style={{ padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: '600', background: tc.bg, color: tc.color }}>{cfg.type}</span>
                        </td>

                        {/* Value cell — shows inline editor when editing */}
                        <td style={{ ...td, maxWidth: '260px' }} onClick={isEditing ? e => e.stopPropagation() : undefined}>
                          {isEditing ? (
                            cfg.type === 'boolean' ? (
                              <select value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus
                                style={{ padding: '6px 10px', border: '1.5px solid #6366f1', borderRadius: '5px', fontSize: '13px', outline: 'none' }}>
                                <option value="true">true</option>
                                <option value="false">false</option>
                              </select>
                            ) : cfg.type === 'json' ? (
                              <textarea value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus rows={3}
                                style={{ width: '100%', padding: '6px 10px', border: '1.5px solid #6366f1', borderRadius: '5px', fontSize: '12px', fontFamily: 'monospace', outline: 'none', resize: 'vertical', boxSizing: 'border-box' }} />
                            ) : (
                              <input value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus
                                type={cfg.type === 'number' ? 'number' : 'text'}
                                style={{ width: '100%', padding: '6px 10px', border: '1.5px solid #6366f1', borderRadius: '5px', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
                            )
                          ) : (
                            cfg.type === 'boolean'
                              ? <span style={{ padding: '2px 8px', borderRadius: '10px', fontSize: '12px', background: cfg.value ? '#e8f5e9' : '#ffebee', color: cfg.value ? '#2e7d32' : '#c62828', fontWeight: '600' }}>{String(cfg.value)}</span>
                              : <span style={{ color: '#444', fontFamily: cfg.type === 'json' ? 'monospace' : 'inherit', fontSize: cfg.type === 'json' ? '12px' : '14px', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{formatValue(cfg.value, cfg.type)}</span>
                          )}
                        </td>

                        <td style={td}>
                          <span style={{ padding: '2px 8px', borderRadius: '10px', fontSize: '12px', background: '#f0f0f0', color: '#555', fontFamily: 'monospace' }}>v{cfg.version}</span>
                        </td>
                        <td style={{ ...td, color: '#999', fontSize: '12px' }}>{timeAgo(cfg.updatedAt)}</td>

                        {/* Actions */}
                        <td style={{ ...td, whiteSpace: 'nowrap' }} onClick={e => e.stopPropagation()}>
                          {isEditing ? (
                            <div style={{ display: 'flex', gap: '6px' }}>
                              <button onClick={e => saveEdit(cfg, e)} disabled={editSaving}
                                style={{ padding: '4px 12px', background: '#1a1a2e', color: 'white', border: 'none', borderRadius: '4px', cursor: editSaving ? 'not-allowed' : 'pointer', fontSize: '12px', fontWeight: '600' }}>
                                {editSaving ? '…' : 'Save'}
                              </button>
                              <button onClick={cancelEdit}
                                style={{ padding: '4px 10px', background: 'transparent', color: '#888', border: '1px solid #ddd', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', gap: '6px' }}>
                              {canWrite && (
                                <button onClick={e => startEdit(cfg, e)}
                                  style={{ padding: '4px 10px', background: 'transparent', color: '#6366f1', border: '1px solid #6366f1', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>
                                  Edit
                                </button>
                              )}
                              {canDelete && (
                                <button onClick={e => handleDelete(cfg, e)}
                                  style={{ padding: '4px 10px', background: 'transparent', color: '#d32f2f', border: '1px solid #d32f2f', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>
                                  Delete
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Version history side panel */}
          {selectedConfig && (
            <div style={{ width: '320px', flexShrink: 0, background: 'white', borderRadius: '10px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid #f0f0f0', background: '#f8f9fa' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontFamily: 'monospace', fontWeight: '700', fontSize: '13px', color: '#1a1a2e', wordBreak: 'break-all' }}>{selectedConfig.key}</div>
                    <div style={{ fontSize: '12px', color: '#888', marginTop: '2px' }}>{selectedConfig.environment} · {selectedConfig.type}</div>
                  </div>
                  <button onClick={() => setSelectedConfig(null)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#aaa', fontSize: '18px', lineHeight: 1, padding: '0 0 0 8px' }}>×</button>
                </div>
              </div>

              <div style={{ padding: '16px 20px', borderBottom: '1px solid #f0f0f0' }}>
                <div style={{ fontSize: '11px', fontWeight: '700', color: '#999', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>Current Value</div>
                <div style={{ fontFamily: selectedConfig.type === 'json' ? 'monospace' : 'inherit', fontSize: '13px', color: '#222', whiteSpace: 'pre-wrap', wordBreak: 'break-all', background: '#f8f9fa', padding: '10px 12px', borderRadius: '6px' }}>
                  {formatValue(selectedConfig.value, selectedConfig.type)}
                </div>
              </div>

              <div style={{ padding: '16px 20px' }}>
                <div style={{ fontSize: '11px', fontWeight: '700', color: '#999', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '12px' }}>Version History</div>
                {loadingVersions ? (
                  <div style={{ textAlign: 'center', color: '#ccc', padding: '20px 0', fontSize: '13px' }}>Loading…</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {versions.map(v => {
                      const isActive = v.version === selectedConfig.version;
                      return (
                        <div key={v.version} style={{ padding: '10px 12px', borderRadius: '6px', border: isActive ? '1.5px solid #1a1a2e' : '1px solid #eee', background: isActive ? '#f0f4ff' : 'white' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                            <span style={{ fontFamily: 'monospace', fontWeight: '700', fontSize: '12px', color: '#1a1a2e' }}>v{v.version}</span>
                            {isActive ? (
                              <span style={{ fontSize: '10px', fontWeight: '700', background: '#1a1a2e', color: 'white', padding: '2px 6px', borderRadius: '8px' }}>ACTIVE</span>
                            ) : canWrite ? (
                              <button onClick={() => handleRollback(v.version)} disabled={rolling}
                                style={{ fontSize: '11px', padding: '2px 8px', background: 'transparent', border: '1px solid #1a1a2e', color: '#1a1a2e', borderRadius: '4px', cursor: rolling ? 'not-allowed' : 'pointer' }}>
                                {rolling ? '…' : 'Rollback'}
                              </button>
                            ) : null}
                          </div>
                          <div style={{ fontFamily: 'monospace', fontSize: '12px', color: '#555', whiteSpace: 'pre-wrap', wordBreak: 'break-all', marginBottom: '4px' }}>
                            {formatValue(v.value, v.type || selectedConfig.type)}
                          </div>
                          <div style={{ fontSize: '11px', color: '#aaa' }}>{timeAgo(v.createdAt)}</div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const labelStyle = { display: 'block', marginBottom: '6px', fontWeight: '600', fontSize: '12px', color: '#555', textTransform: 'uppercase', letterSpacing: '0.3px' };
const inputStyle = { width: '100%', padding: '9px 12px', border: '1px solid #e0e0e0', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box', outline: 'none', background: '#fafafa' };
const th = { padding: '12px 16px', textAlign: 'left', fontWeight: '600', fontSize: '12px', color: '#666', textTransform: 'uppercase', letterSpacing: '0.4px' };
const td = { padding: '14px 16px', fontSize: '14px' };
